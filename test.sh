#!/bin/bash
ab -n 100000 -c 50 http://localhost:3000/new-customer?email=user@bob.io