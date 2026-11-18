import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**", ".dev-keys/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "TSEnumDeclaration", message: "Use string-literal unions; enums are not erasable syntax." }
      ]
    }
  }
);
