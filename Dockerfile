FROM oven/bun:alpine

ENV PORT=80

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install

COPY . .

EXPOSE ${PORT}

CMD ["bun", "start"]
