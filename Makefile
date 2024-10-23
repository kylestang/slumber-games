# https://github.com/brillout/build-worker/blob/master/build-worker.mjs
build:
	esbuild src/index.ts --outfile=dist/index.js --platform=browser \
	--format=esm --target=esnext --minify --bundle

deploy: build
	terraform apply
