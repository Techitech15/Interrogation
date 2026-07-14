export type DeepReadonly<T> = T extends (...args: infer TArgs) => infer TResult
  ? (...args: TArgs) => TResult
  : T extends readonly (infer TItem)[]
    ? readonly DeepReadonly<TItem>[]
    : T extends object
      ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
      : T;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    Object.isFrozen(value)
  ) {
    return value as DeepReadonly<T>;
  }

  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export function defensiveCloneAndFreeze<T>(value: T): DeepReadonly<T> {
  return deepFreeze(structuredClone(value));
}
