FROM ghcr.io/puppeteer/puppeteer:21.3.8

ENV CHROMIUM_USER_DATA=.config/chrome_profile

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Copy the token.json file with the correct permissions
COPY --chown=node:node ./config/jsons/token.json /usr/src/app/config/jsons/token.json

USER node

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]