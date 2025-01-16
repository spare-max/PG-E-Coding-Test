# Steps to Build and Run the Container
## Step 1: Build the Docker Image

Run the following command to build the Docker image:
    

    docker build -t my-node-app .


## Step 2: Run the Container

Run the container using:

    docker run -p 3000:3000 my-node-app

## Step 3: Access the Application

Open your browser and navigate to 
    http://localhost:3000.

## API Gateway URL

Open your browser and navigate to https://smfu783ws6.execute-api.us-east-1.amazonaws.com/dev/lambda

# Steps to Run using Docker compose

Run the following command to build and run the Docker image:

    docker compose up


