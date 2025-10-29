import isHexadecimal from "./isHexadecimal";
import assertString from "./util/assertString";

export default function isMongoId(str) {
  assertString(str);
  return isHexadecimal(str) && str.length === 24;
}
