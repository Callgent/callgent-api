/**
 * helper to support exclusion selection, when param `mergedSelect`.values() are all booleans and contains false,
 * e.g. mergedSelect: { pk: false, deletedAt: false, name: true }: means, select all columns except pk, deletedAt
 *
 * @param select if select.values() no false, then do inclusion select, ignore defaultSelect
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
  if (notArray) [result] = result;
  return result;
}

/**
 * @param select if no false, inclusion select, else exclusion select
 */
function mergeSelects<S extends object>(defaultSelect: S, select?: S): S {
  if (!select) return defaultSelect;
  if (Object.values(select).every((value) => !!value)) return select;

  select = { ...defaultSelect, ...select };
  // if all values are boolean, and has any false, then do exclusion select: delete true keys
  const vals = Object.values(select);
  if (vals.includes(false) && vals.every((value) => typeof value === 'boolean'))
    for (const key in select) select[key] && delete select[key];

  return select;
}
