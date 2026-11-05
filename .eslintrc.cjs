const STORAGE_MESSAGE =
	"Use the storage wrapper (src/services/storage.js) instead of touching browser storage directly.";

const storageRules = (severity) => ({
	"no-restricted-globals": [
		severity,
		{ name: "localStorage", message: STORAGE_MESSAGE },
		{ name: "sessionStorage", message: STORAGE_MESSAGE },
	],
	"no-restricted-properties": [
		severity,
		{ object: "window", property: "localStorage", message: STORAGE_MESSAGE },
		{ object: "window", property: "sessionStorage", message: STORAGE_MESSAGE },
		{ object: "globalThis", property: "localStorage", message: STORAGE_MESSAGE },
		{ object: "globalThis", property: "sessionStorage", message: STORAGE_MESSAGE },
	],
});

module.exports = {
	root: true,
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:react/recommended",
		"plugin:react/jsx-runtime",
	],
	settings: {
		react: {
			version: "detect",
		},
	},
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	plugins: ["react"],
	ignorePatterns: ["node_modules", "dist"],
	rules: {
		"no-unused-vars": ["error", { args: "none" }],
		"react/prop-types": "off",
		...storageRules("error"),
	},
	overrides: [
		{
			files: [
				"src/services/storage.js",
				"src/services/database/**",
				"src/storage-migrations.js",
				"src/setupTests.js",
				"**/*.test.*",
			],
			rules: storageRules("off"),
		},
	],
};
