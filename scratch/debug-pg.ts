import pkg from "pg";
import * as pgStar from "pg";

console.log("pg default import:", pkg);
console.log("pg star import:", pgStar);
console.log("pg star default property:", (pgStar as any).default);
