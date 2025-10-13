import toFloat from "./toFloat";
import assertString from "./util/assertString";

export default function isDivisibleBy(str, num) {
  assertString(str);
  return toFloat(str) % parseInt(num, 10) === 0;
}
