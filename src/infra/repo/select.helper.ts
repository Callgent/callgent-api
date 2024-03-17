/**
 * @param select if values all false, then do exclusion select: select *, then delete item[key];
 *  if any value null, then delete defaultSelect[key]
 * @param resultKey prop name of the result list from :query: return
 * @param defaultSelect merged: { ...defaultSelect, ...select }
 */
export const selectHelper = async <S extends object, T>(
  select: S,
  query: (select?: S) => Promise<T>,
  defaultSelect?: S,
  resultKey?: string,
): Promise<T> => {
  if (defaultSelect) select = mergeSelects(defaultSelect, select);

  const selectKeys = select && Object.keys(select);
  if (!selectKeys?.length) return query();

  const allFalse = Object.values(select).every((value) => !value);
  // if all false, do exclusion select
  const actualSelect = allFalse ? undefined : select;
  const result = await query(actualSelect);
  if (!allFalse || !result) return result;

  // filter all exclusions
  if (!resultKey) return doExclusionSelect(selectKeys, result);

  result[resultKey] = doExclusionSelect(selectKeys, result[resultKey]);
  return result;
};

function doExclusionSelect(select: string[], result: any) {
  const notArray = !Array.isArray(result);
  if (notArray) result = [result];
  result.forEach((item: any) => {
    select.forEach((key) => delete item[key]);
  });
  if (notArray) result = result[0];
  return result;
}
function mergeSelects<S extends object>(defaultSelect: S, select: S): S {
  if (!select) return defaultSelect;

  select = { ...select };
  Object.entries(defaultSelect).forEach(([key, value]) => {
    if (!(key in select)) select[key] = value;
    else if (null === select[key]) delete select[key];
  });

  return select;
}
