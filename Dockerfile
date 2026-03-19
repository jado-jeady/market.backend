FROM node:20-alpine
WORKDIR /app
# Add build dependencies if needed for pg (native binaries)
RUN apk add --no-cache python3 make g++ 
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV HOST=::
ENV PORT=8080
EXPOSE 8080
CMD ["node", "main.js"] 
