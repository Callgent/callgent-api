/**
 * mark a function as persisted-async,
 *
 * @param service callback service name
 * @param funName callback function name
 */
export const PersistedAsync = (service: string, funName: number) => {
  /**
   *
   * @param target
   * @param propertyKey
   * @param descriptor
   * @returns
   */
  return (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // console.log('Before execution');

      const result = await originalMethod.apply(this, args);
      // if

      // console.log('After execution');

      return result;
    };

    return descriptor;
  };
};

class SomeService {
  @PersistedAsync('Log this action', 5)
  async someMethod() {
    console.log('Executing the method');
    // call with asyncId, or externalId
    // must support cb
    // const result = await this.external.invoke(...);
    // // sent? 再创建
    // // returns the id
    // return {result, asyncId};
  }
}
