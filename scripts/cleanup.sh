#!/bin/bash

echo "Stopping all betting-platform containers..."
docker compose --profile dev down

echo "Removing betting-platform containers..."
docker rm -f betting-postgres betting-redis betting-rabbitmq betting-frontend 2>/dev/null

echo "Removing betting-platform images..."
docker rmi -f betting-platform-frontend 2>/dev/null
docker rmi -f $(docker images -q --filter "reference=betting-platform*") 2>/dev/null

echo "Removing betting-platform volumes..."
docker volume rm betting-platform_postgres_data betting-platform_redis_data betting-platform_rabbitmq_data 2>/dev/null

echo "Removing dangling images..."
docker image prune -f

echo "Removing unused networks..."
docker network prune -f

echo "Removing node_modules folders..."
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf backend/shared/node_modules
rm -rf backend/api-gateway/node_modules
rm -rf backend/user-service/node_modules
rm -rf backend/wallet-service/node_modules
rm -rf backend/bet-service/node_modules
rm -rf backend/odds-service/node_modules
rm -rf backend/event-service/node_modules

echo "Removing build artifacts..."
rm -rf backend/shared/dist
rm -rf frontend/dist

echo "Cleanup complete!"
