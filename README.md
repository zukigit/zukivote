# zukivote

A self-hosted voting application.

## Getting Started

```sh
sudo docker compose up -d
```

The web app will be available at http://localhost/

## User Guide

### 1. Create a New Voting

After logging in, navigate to **Topics** and click **+ Create Topic**. Fill in the topic name, description, and set the start/end times.

![Creating a new voting](screenshots/creating_new_voting.png)

### 2. Add Candidates

Go to **Items** for your topic and add the candidates or options that voters can choose from.

![Creating candidates](screenshots/creating_candidate.png)

### 3. Add Voters

Navigate to **Voters** and add voters by username. Only registered users added here will be eligible to vote.

![Creating voters](screenshots/creating_voters.png)

### 4. Share Voting Keys

Each voter receives a unique voting key. Share the voting link and key with eligible voters.

![Getting a voting key](screenshots/getting_voting_key.png)

### 5. Cast Votes

Voters open the voting link, enter their key, and select their preferred candidate.

![Voting](screenshots/vote.png)

### 6. View Results

Once voting is active or ended, results are displayed with vote counts for each candidate.

![Voting results](screenshots/voting_result.png)