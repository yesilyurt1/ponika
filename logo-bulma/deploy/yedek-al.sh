#!/bin/sh
# Veri yedeği: sunucu her gün DATA_DIR/yedek altına kendisi yedek alır (14 gün). Bu betik ek olarak
# tüm veriyi sunucu dışına almak için bir arşiv çıkarır. Cron örneği (her gece 03:30):
#   30 3 * * * cd /opt/logo-bulma && sh deploy/yedek-al.sh >> /var/log/lb-yedek.log 2>&1
set -e
OUT="${1:-./yedekler}"; mkdir -p "$OUT"
F="$OUT/lb-$(date +%Y%m%d-%H%M).tar.gz"
docker compose exec -T app tar czf - -C /data . > "$F"
echo "Yedek: $F"
ls -1t "$OUT"/lb-*.tar.gz | tail -n +31 | xargs -r rm -f
