FROM ubuntu:22.04@sha256:5ec03bb3441e8b0bf3b4f9cd4629a1ae763010dc3035bb8da3ae6cf026486401
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 3 https://github.com/AntelopeIO/cdt/releases/download/v4.1.1/cdt_4.1.1-1_amd64.deb -o /tmp/cdt.deb \
 && echo 'd946e6b64f297442d19e486401aa49f956080b07a1fa6335f29976106175b588  /tmp/cdt.deb' | sha256sum -c - \
 && curl -fsSL --retry 3 https://github.com/AntelopeIO/spring/releases/download/v1.2.2/antelope-spring_1.2.2_amd64.deb -o /tmp/spring.deb \
 && echo '531ed1c965f94dd7732f5e900401f132170769c45b7589819a0ba1336627687a  /tmp/spring.deb' | sha256sum -c - \
 && apt-get update && apt-get install -y --no-install-recommends /tmp/cdt.deb /tmp/spring.deb \
 && rm -rf /tmp/*.deb /var/lib/apt/lists/*
WORKDIR /work
