import { createReadStream, createWriteStream } from "node:fs";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Injectable } from "@nestjs/common";

export interface PostgresBackupTool {
  create(destination: string): Promise<void>;
  inspect(source: string): Promise<{ entryCount: number }>;
  restore(source: string): Promise<void>;
}

@Injectable()
export class DockerPostgresBackupTool implements PostgresBackupTool {
  private readonly container =
    process.env.BACKUP_POSTGRES_CONTAINER ?? "compose-postgres-1";
  private readonly database = process.env.BACKUP_DATABASE ?? "yc_erp";
  private readonly user = process.env.BACKUP_DATABASE_USER ?? "yc_erp";

  constructor() {
    for (const value of [this.container, this.database, this.user]) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) {
        throw new Error("Invalid PostgreSQL backup tool configuration");
      }
    }
  }

  async create(destination: string) {
    const child = spawn(
      "docker",
      [
        "exec",
        this.container,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--username",
        this.user,
        "--dbname",
        this.database,
      ],
      { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const output = createWriteStream(destination, { flags: "wx" });
    child.stdout.pipe(output);
    await Promise.all([
      this.wait(child, "创建数据库备份失败", output),
      new Promise<void>((resolve, reject) => {
        output.once("finish", resolve);
        output.once("error", reject);
      }),
    ]);
  }

  async inspect(source: string) {
    await access(source);
    const child = spawn(
      "docker",
      ["exec", "-i", this.container, "pg_restore", "--list"],
      { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    createReadStream(source).pipe(child.stdin);
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (output += chunk));
    await this.wait(child, "备份归档结构校验失败");
    const entryCount = output
      .split(/\r?\n/)
      .filter((line) => /^\d+;/.test(line.trim())).length;
    if (entryCount === 0) throw new Error("备份归档中没有可恢复的数据库对象");
    return { entryCount };
  }

  async restore(source: string) {
    await access(source);
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        this.container,
        "pg_restore",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        "--username",
        this.user,
        "--dbname",
        this.database,
      ],
      { shell: false, windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
    );
    createReadStream(source).pipe(child.stdin);
    await this.wait(child, "数据库恢复失败");
  }

  private wait(
    child: ReturnType<typeof spawn>,
    publicMessage: string,
    output?: ReturnType<typeof createWriteStream>,
  ) {
    return new Promise<void>((resolve, reject) => {
      let stderr = "";
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        if (stderr.length < 4_000) stderr += chunk;
      });
      child.once("error", (error) => {
        output?.destroy();
        reject(new Error(`${publicMessage}：${error.message}`));
      });
      child.once("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        output?.destroy();
        const detail = stderr.trim().split(/\r?\n/).at(-1);
        reject(
          new Error(detail ? `${publicMessage}：${detail}` : publicMessage),
        );
      });
    });
  }
}
