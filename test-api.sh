#!/bin/bash

echo "🧪 Testing Task Management API CRUD Operations"
echo "=============================================="
echo ""

BASE_URL="http://localhost:3001"
USER_ID="test-user-$(date +%s)"

echo "📝 User ID: $USER_ID"
echo ""

# 1. CREATE Task
echo "1️⃣ CREATE - Tạo task mới"
echo "------------------------"
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/tasks?userId=${USER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test CRUD Operations",
    "description": "Testing all endpoints",
    "status": "TODAY",
    "priority": "HIGH",
    "estimatedPomodoros": 3,
    "tags": ["test", "crud"]
  }')

echo "$CREATE_RESPONSE" | head -20
TASK_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "✅ Created task ID: $TASK_ID"
echo ""

# 2. GET All Tasks
echo "2️⃣ GET - Lấy tất cả tasks"
echo "------------------------"
curl -s "${BASE_URL}/tasks?userId=${USER_ID}" | head -30
echo ""
echo ""

# 3. GET One Task
echo "3️⃣ GET - Lấy 1 task cụ thể"
echo "------------------------"
curl -s "${BASE_URL}/tasks/${TASK_ID}?userId=${USER_ID}" | head -20
echo ""
echo ""

# 4. GET Stats
echo "4️⃣ GET - Thống kê tasks"
echo "------------------------"
curl -s "${BASE_URL}/tasks/stats?userId=${USER_ID}"
echo ""
echo ""

# 5. UPDATE Task
echo "5️⃣ UPDATE - Cập nhật task"
echo "------------------------"
curl -s -X PATCH "${BASE_URL}/tasks/${TASK_ID}?userId=${USER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE",
    "completedPomodoros": 3
  }' | head -20
echo ""
echo ""

# 6. ARCHIVE Task
echo "6️⃣ ARCHIVE - Archive task"
echo "------------------------"
curl -s -X PATCH "${BASE_URL}/tasks/${TASK_ID}/archive?userId=${USER_ID}" | head -20
echo ""
echo ""

# 7. DELETE Task
echo "7️⃣ DELETE - Xóa task"
echo "------------------------"
curl -s -X DELETE "${BASE_URL}/tasks/${TASK_ID}?userId=${USER_ID}" | head -20
echo ""
echo ""

echo "✅ All CRUD operations completed!"
