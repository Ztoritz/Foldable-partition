# Build Stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files first to leverage cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set base path to root for VPS deployment by default
# You can override this with --build-arg VITE_BASE_PATH=/subpath/
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Build the application
# Force output to 'dist' to ensure standard behavior for container
RUN npm run build -- --outDir dist

# Production Stage
FROM nginx:alpine

# Copy the build output from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
