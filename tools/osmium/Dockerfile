# osmium-tool for machines without it (Windows): lib/places/osmium.ts runs it
# here when OSMIUM_DOCKER=1. GitHub Actions installs the same package with apt.
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends osmium-tool \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
