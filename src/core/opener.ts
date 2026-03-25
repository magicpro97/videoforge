import { exec } from 'node:child_process';
import { platform } from 'node:os';

export function openFile(filePath: string): void {
  const os = platform();
  let command: string;
  if (os === 'darwin') {
    command = `open "${filePath}"`;
  } else if (os === 'win32') {
    command = `start "" "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }
  exec(command);
}
