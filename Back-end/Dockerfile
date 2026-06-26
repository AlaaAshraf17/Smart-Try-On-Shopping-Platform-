FROM node:20-slim

WORKDIR /app

RUN useradd -m user
RUN chown -R user:user /app

USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

COPY --chown=user:user package*.json ./

RUN npm install --production

RUN mkdir -p uploads && chmod 777 uploads

COPY --chown=user:user . .

EXPOSE 7860

CMD ["node", "server.js"]