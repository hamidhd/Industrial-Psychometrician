import path from 'path';
import esbuild from '/tmp/node_modules/esbuild/lib/main.js';

const ROOT = path.resolve(import.meta.dirname);
const SHIM = path.join(ROOT, 'src-shim');
const NM = '/tmp/node_modules';

const plugin = {
  name: 'wp-shims',
  setup(build) {
    build.onResolve({ filter: /^lucide-react$/ }, () => ({ path: path.join(SHIM, 'empty.tsx') }));
    build.onResolve({ filter: /^firebase\/(auth|firestore)$/ }, () => ({ path: path.join(SHIM, 'firebase-mod.ts') }));
    build.onResolve({ filter: /^firebase/ }, () => ({ path: path.join(SHIM, 'firebase-mod.ts') }));
    build.onResolve({ filter: /(^|\/)(firebase|utils\/tauriBridge|components\/AuthBridgeView)$/ }, (args) => {
      const base = path.basename(args.path);
      if (base === 'firebase') return { path: path.join(SHIM, 'firebase.ts') };
      if (base === 'tauriBridge') return { path: path.join(SHIM, 'tauriBridge.ts') };
      if (base === 'AuthBridgeView') return { path: path.join(SHIM, 'empty.tsx') };
      return undefined;
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(ROOT, 'wp-entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  jsx: 'automatic',
  nodePaths: [NM],
  define: {
    __APP_VERSION__: '"6.0.0"',
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [plugin],
  outfile: path.join(ROOT, 'assets/app.js'),
  logLevel: 'info',
});
