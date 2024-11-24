import { exec } from "child_process";

export const copyToClipboard = (text: string) => {
  const command = `echo "${text.replace(/\\/g, '\\\\').replace(/\`/g, '\\`').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (process.platform === 'darwin') {
    exec(`${command} | pbcopy`);
  } else if (process.platform === 'win32') {
    exec(`${command} | clip`);
  } else if (process.platform === 'linux') {
    exec(`${command} | xclip -selection clipboard -l`);
  } else {
    console.error('Unsupported platform:', process.platform);
  }
}
