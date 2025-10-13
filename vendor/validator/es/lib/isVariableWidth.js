import { fullWidth } from "./isFullWidth";
import { halfWidth } from "./isHalfWidth";
import assertString from "./util/assertString";

export default function isVariableWidth(str) {
  assertString(str);
  return fullWidth.test(str) && halfWidth.test(str);
}
