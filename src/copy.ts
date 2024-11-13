import { exec } from "child_process";

export const copyToClipboard = (text: string) => {
  const command = `echo "${text}" |  tr -d "\n"`;
  if (process.platform === 'darwin') {
    exec(`${command} | pbcopy`);
  } else if (process.platform === 'win32') {
    exec(`${command} | clip`);
  } else if (process.platform === 'linux') {
    exec(`${command} | xclip -selection clipboard`);
  } else {
    console.error('Unsupported platform:', process.platform);
  }
}
