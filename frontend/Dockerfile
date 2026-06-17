# Stage 1: Build the React application
FROM node:20-alpine AS build

#FROM node:20-alpine: Starts with a base image that has Node.js (version 20) pre-installed on Alpine Linux (an extremely lightweight Linux distribution).
#AS build: Names this stage "build".

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve the build files using Nginx
FROM nginx:alpine

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output files to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
