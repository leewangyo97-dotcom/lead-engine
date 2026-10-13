# SpamAssassin, for `pnpm spam:check`.
#
# The check runs with -L (local tests only), so no email content leaves the
# machine and no blocklists are queried. Those lookups are about the link's
# domain, not the words, and were checked by hand on 13 Oct. sa-update fetches
# the current rule set when the image is built.
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends spamassassin ca-certificates gnupg \
 && rm -rf /var/lib/apt/lists/* \
 && (sa-update || true)

ENTRYPOINT ["spamassassin", "-t", "-L"]
