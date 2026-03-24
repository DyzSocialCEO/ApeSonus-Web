FROM nginx:alpine
COPY public/ /usr/share/nginx/html/
COPY public/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
