FROM nginx:alpine

LABEL org.opencontainers.image.title="AGENZI Content OS"
LABEL org.opencontainers.image.description="Internal social media content operations workspace for AGENZI Digital Mandiri"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
