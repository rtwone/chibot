import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomUUID, scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { getAdminByUsername, init, insertAdmin } from "../lib/store.mjs";

const scrypt = promisify(scryptCallback);
const rl = readline.createInterface({ input: stdin, output: stdout });

async function readHiddenPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return rl.question("Admin password (minimum 12 characters): ");
  }
  rl.close();
  stdout.write("Admin password (minimum 12 characters): ");
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let password = "";
    const finish = (value) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          reject(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(password);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    };
    stdin.on("data", onData);
  });
}

try {
  await init();
  const username = (await rl.question("Admin username: ")).trim();
  const password = await readHiddenPassword();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Username must be 3–40 characters: letters, numbers, dot, underscore, or hyphen.");
  }
  if (password.length < 12 || password.length > 200) {
    throw new Error("Password must be between 12 and 200 characters.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  if (await getAdminByUsername(username)) throw new Error("That username is already in use.");
  await insertAdmin({ id: randomUUID(), username, password_hash: `scrypt$${salt}$${hash}` });
  console.log(`Admin account "${username}" created.`);
} catch (error) {
  console.error(`Could not create admin: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
