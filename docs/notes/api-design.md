# API design

GET (read)
POST (create)
PUT (replace)
PATCH (update)
DELETE (delete)

POST /todos → Create todo  
GET /todos → List todos  
GET /todos/{id} → Get a specific todo  
PUT /todos/{id} → Replace entire todo  
PATCH /todos/{id} → Update fields  
DELETE /todos/{id} → Delete todo

Use lowercase with hyphens (/user-profiles

Only nest when something truly belongs to something else. User settings belong to and die with the user, so /users/{id}/settings makes sense. Comments can exist independently, so /users/{id}/posts/{postId}/comments can be simplified.

# Instead of deep nesting

GET /users/{userId}/habits/{habitId}/entries

# Use filters for flexibility

GET /entries?userId={userId}&habitId={habitId}
GET /entries?habitId={habitId} # Now you can get entries without knowing the user

Response {data, meta, pagination, total, hasMore, nextCursor}

// What you ship first
{ "id": 1, "name": "John Doe" }

// What you ship later (keeping the old field)
{
"id": 1,
"name": "John Doe", // Still there! Mark it deprecated in docs
"firstName": "John",
"lastName": "Doe"
}
GET /users/{id}?include=habits,entries
GET /users/{id}?format=detailed

GET /entries?habitId=123&date=2025-08-01&status=completed
GET /entries/search?q=morning+run+park

// GOOD: Query for filtering/sorting/pagination
GET /api/users?role=admin&sort=created_at&limit=20
// GOOD: Query for search
GET /api/users?search=john&status=active

RFC 9457

{
"type": "https://api.example.com/errors/validation-failed",
"title": "Validation Failed",
"status": 400,
"detail": "The request body contains invalid fields",
"instance": "/habits/123",
"errors": [{
"field": "name",
"reason": "Must be between 1 and 100 characters",
"value": ""
},
{
"field": "frequency",
"reason": "Must be one of: daily, weekly, monthly",
"value": "sometimes"
}]
}

400 Bad Request: You sent garbage
401 Unauthorized: Who are you? Authentication (who are you?)
403 Forbidden: I know who you are, but no. Authorization (what can you do?)
404 Not Found: That thing doesn't exist
409 Conflict: That conflicts with something
422 Unprocessable Entity: I understand what you want, but it's wrong
429 Too Many Requests: Slow down, cowboy
500 Internal Server Error: We screwed up
503 Service Unavailable: We're drowning, try again later

// Success codes (2xx)
200 OK // Successful GET, PUT, PATCH, DELETE
201 Created // Successful POST
204 No Content // Successful DELETE (no response body)
202 Accepted // Request accepted, processing async
// Client error codes (4xx)
400 Bad Request // Invalid request format
401 Unauthorized // Not authenticated
403 Forbidden // Authenticated but not authorized
404 Not Found // Resource doesn't exist
405 Method Not Allowed // Wrong HTTP method
409 Conflict // Resource conflict (duplicate, version mismatch)
422 Unprocessable Entity // Validation error
429 Too Many Requests // Rate limit exceeded
// Server error codes (5xx)
500 Internal Server Error // Generic server error
502 Bad Gateway // Upstream service error
503 Service Unavailable // Temporary downtime
504 Gateway Timeout // Upstream service timeout

{
"data": [{ "id": "1", "name": "User 1" },
{ "id": "2", "name": "User 2" }],
"meta": {
"total": 100,
"page": 1,
"per_page": 20,
"total_pages": 5
},
"links": {
"self": "/api/users?page=1",
"first": "/api/users?page=1",
"prev": null,
"next": "/api/users?page=2",
"last": "/api/users?page=5"
}
}

{
"error": {
"code": "VALIDATION_ERROR",
"message": "Invalid request data",
"details": [{
"field": "email",
"message": "Invalid email format"
},
{
"field": "age",
"message": "Must be at least 18"
}]
},
"meta": {
"request_id": "abc-123-def",
"timestamp": "2024-01-15T10:30:00Z"
}
}

router.get('/users/:id', (req, res) => {
// Cache for 5 minutes
res.set('Cache-Control', 'public, max-age=300');

// ETag for conditional requests
const etag = generateETag(userData);
res.set('ETag', etag);

if (req.headers['if-none-match'] === etag) {
return res.status(304).send(); // Not Modified
}

res.json({ data: userData });
});
// No caching for dynamic data
router.get('/dashboard', (req, res) => {
res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
res.json({ data: dashboardData });
});

// VALIDATE BODY WITH ZOD

// SERVICE LAYER LOGIC

// API RESPONSE CLASS
