FROM ghcr.io/puppeteer/puppeteer:21.3.8

RUN mkdir -p /app/chromium-profile
COPY ./chrome-profile /app/chromium-profile

ENV CHROMIUM_USER_DATA=/app/chromium-profile

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]