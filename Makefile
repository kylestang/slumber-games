# https://github.com/brillout/build-worker/blob/master/build-worker.mjs
build:
	cd updater && \
	esbuild src/index.ts --outfile=dist/index.js --platform=browser \
	--sourcemap=inline --format=esm --target=esnext --bundle

deploy: build
	terraform apply
