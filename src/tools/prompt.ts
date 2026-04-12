import * as readline from 'readline';

function rl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export function ask(question: string): Promise<string> {
  const iface = rl();
  return new Promise((resolve) => {
    iface.question(question, (answer) => {
      iface.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/n] `);
  return answer.toLowerCase().startsWith('y');
}

export async function select<T>(prompt: string, options: Array<{ label: string; value: T }>): Promise<T> {
  console.log(prompt);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
  while (true) {
    const answer = await ask(`Select [1-${options.length}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx].value;
    console.log(`  Enter a number between 1 and ${options.length}.`);
  }
}
