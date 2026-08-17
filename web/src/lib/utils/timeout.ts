export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, onTimeout: () => T | never): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<any>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      try {
        resolve(onTimeout());
      } catch (e) {
        reject(e);
      }
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timeoutId!));
}
