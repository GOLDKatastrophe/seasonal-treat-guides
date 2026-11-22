SEASONS := $(wildcard seasons/*.json)
SLUGS   := $(notdir $(basename $(SEASONS)))

.PHONY: all clean check

all:
	@rm -rf dist && mkdir -p dist
	@for s in $(SLUGS); do \
	  mkdir -p dist/$$s; \
	  python3 tools/build.py seasons/$$s.json dist/$$s/index.html || exit 1; \
	  node tools/render_pdfs.js dist/$$s/index.html dist/$$s || exit 1; \
	done
	@python3 tools/make_index.py $(SEASONS) dist/index.html
	@echo "dist/ ready:"
	@find dist -type f | sort | sed 's/^/  /'

check: all
	@node tools/check_build.js

clean:
	@rm -rf dist
