#!/bin/bash

# ANSI Color Codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}====================================================${NC}"
echo -e "${YELLOW}    indiiOS AGENT PROTOCOL RUNNER  ${NC}"
echo -e "${YELLOW}====================================================${NC}"

# Function to run a specific test agent
run_agent() {
    AGENT_NAME=$1
    TEST_FILE=$2
    
    echo -e "\n${YELLOW}>>> Activating Agent: ${AGENT_NAME}${NC}"
    
    if [ ! -f "$TEST_FILE" ]; then
        echo -e "${RED}[ERROR] Protocol file missing: ${TEST_FILE}${NC}"
        return 1
    fi

    npx playwright test "$TEST_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[SUCCESS] Agent ${AGENT_NAME} reported mission success.${NC}"
        return 0
    else
        echo -e "${RED}[FAILURE] Agent ${AGENT_NAME} failed the mission.${NC}"
        return 1
    fi
}

# 1. The Gatekeeper (Auth)
run_agent "The Gatekeeper" "e2e/auth-flow.spec.ts"
GATEKEEPER_STATUS=$?

# 2. The Gauntlet (Load/Performance)
run_agent "The Gauntlet" "e2e/stress-test.spec.ts"
GAUNTLET_STATUS=$?

# 3. Fear Factor (Chaos)
run_agent "Fear Factor" "e2e/fear-factor.spec.ts"
FEAR_FACTOR_STATUS=$?

# 4. The Paparazzi (Visual Regression)
run_agent "The Paparazzi" "e2e/the-paparazzi.spec.ts"
PAPARAZZI_STATUS=$?

# 5. The Librarian (RAG)
run_agent "The Librarian" "e2e/the-librarian.spec.ts"
LIBRARIAN_STATUS=$?

# Summary
echo -e "\n${YELLOW}====================================================${NC}"
echo -e "${YELLOW}    MISSION REPORT  ${NC}"
echo -e "${YELLOW}====================================================${NC}"

if [ $GATEKEEPER_STATUS -eq 0 ]; then
    echo -e "The Gatekeeper: ${GREEN}OPERATIONAL${NC}"
else
    echo -e "The Gatekeeper: ${RED}COMPROMISED${NC}"
fi

if [ $GAUNTLET_STATUS -eq 0 ]; then
    echo -e "The Gauntlet:   ${GREEN}PASSED${NC}"
else
    echo -e "The Gauntlet:   ${RED}FAILED${NC}"
fi

if [ $FEAR_FACTOR_STATUS -eq 0 ]; then
    echo -e "Fear Factor:    ${GREEN}SURVIVED${NC}"
else
    echo -e "Fear Factor:    ${RED}DIED${NC}"
fi

if [ $PAPARAZZI_STATUS -eq 0 ]; then
    echo -e "The Paparazzi:  ${GREEN}FOCUSED${NC}"
else
    echo -e "The Paparazzi:  ${RED}BLURRED${NC}"
fi

if [ $LIBRARIAN_STATUS -eq 0 ]; then
    echo -e "The Librarian:  ${GREEN}INDEXED${NC}"
else
    echo -e "The Librarian:  ${RED}LOST${NC}"
fi

# Exit with failure if any test failed
if [ $GATEKEEPER_STATUS -ne 0 ] || [ $GAUNTLET_STATUS -ne 0 ] || [ $FEAR_FACTOR_STATUS -ne 0 ] || [ $PAPARAZZI_STATUS -ne 0 ] || [ $LIBRARIAN_STATUS -ne 0 ]; then
    exit 1
fi

exit 0
