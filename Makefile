build:
	cd updater && npx tsc --outDir dist -p .

deploy: build
	terraform apply
