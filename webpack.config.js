import { resolve, dirname } from 'path';

export default {
	entry: './esm/index.js',
	output: {
		filename: 'index.js',
		path: resolve(dirname(new URL(import.meta.url).pathname), 'commonjs'),
		hashFunction: 'sha256',
		library: {
			name: 'DxfParser',
			type: 'umd',
			export: 'DxfParser'
		},
		globalObject: 'typeof self !== \'undefined\' ? self : this'
	}
};
