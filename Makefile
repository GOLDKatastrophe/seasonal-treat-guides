SEASONS := $(wildcard seasons/*.json)
SLUGS   := $(notdir $(basename $(SEASONS)))

# The live site's address. Social link previews need absolute URLs, so this is
# the one place the domain is set for the build.
SITE_URL ?= https://treats.kylejgold.com
export SITE_URL

.PHONY: all clean check previews

all:
	@rm -rf dist && mkdir -p dist
	@for s in $(SLUGS); do \
	  mkdir -p dist/$$s; \
	  python3 tools/build.py seasons/$$s.json dist/$$s/index.html || exit 1; \
	  node tools/render_pdfs.js dist/$$s/index.html dist/$$s || exit 1; \
	  cp previews/$$s.png dist/$$s/preview.png 2>/dev/null || echo "  no preview for $$s: run make previews"; \
	done
	@python3 tools/make_index.py $(SEASONS) dist/index.html
	@python3 tools/make_sitemap.py $(SEASONS) dist/
	@cp previews/index.png dist/preview.png 2>/dev/null || echo "  no landing preview: run make previews"
	@echo "dist/ ready:"
	@find dist -type f | sort | sed 's/^/  /'

check: all
	@node tools/check_build.js

# Link-preview cards; needs Chrome. Re-run when a season is added, retitled,
# redated or recoloured (make check says when).
previews:
	@node tools/render_previews.js

clean:
	@rm -rf dist
