import ltrim from "./ltrim";
import rtrim from "./rtrim";

export default function trim(str, chars) {
  return rtrim(ltrim(str, chars), chars);
}
