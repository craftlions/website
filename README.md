- Add GitHub Linking to Database
- Add Archived State & Filter

- (Notifications e.g. Mail, Slack, Webhook)
- Self-service
  - API
    - Projects
    - Milestones
    - Invoices
  - Export CSV 

## commands

Install all dev tools
```shell
mise i
```

Install all deps if not done by `mise`
```shell
pn i
aube ci
aube i
```

Update browserlist
```shell
pn update-browserslist-db latest
aube exec update-browserslist-db latest
```

Generate types
```shell
pn run types
aubr types
```

sync astro
```shell
pn astro sync
aubx astro sync
```

Biome
```shell
pn biome check --write
aubx biome check --write
```

Types
```shell
pn run check
aubr check
```

Deploy to cloudflare
```shell
pn run deploy
aubr deploy
```

```shell
pn auth info
pn auth generate

pn drizzle-kit generate
pn drizzle-kit check

pn drizzle-kit migrate
```

```shell
git switch $1
git fetch --all
git rebase -i origin/main

git switch main
git pull
git merge --ff-only $1

git push

git branch -d $1
git push origin --delete $1
```

NOTES

```ALWAYS CLIENT
const { data, error } = await authClient.signIn.email({
    email: "john.doe@example.com", // required
    password: "password1234", // required
    rememberMe: true,
    callbackURL: "/dashboard",
},{
    onError: (ctx) => {
      // Handle the error
      if (ctx.error.status === 403) {
        alert("Please verify your email address");
      }
      //you can also show the original error message
      alert(ctx.error.message);
    },
  });
```

```ALWAYS CLIENT
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push("/login"); // redirect to login page
    },
  },
});
```

```ALWAYS CLIENT
import { authClient } from "~/lib/auth-client"; //import the auth client
authClient.useSession.subscribe((value)=>{
    //do something with the session //
}
```

```ALWAYS SERVER
import { auth } from "./auth"; // path to your Better Auth server instance
import { headers } from "next/headers";
const session = await auth.api.getSession({
    headers: await headers() // you need to pass the headers object.
})
```

```MAYBE SERVER
const res = await auth.api.signUpEmail({
	body: {
		email: "alexander@nbhr.de",
		password: "Lexbusni1998!",
		name: "Alexander Niebuhr",
	},
	headers: Astro.request.headers
});
console.log(res)
```

```
const { data, error } = await authClient.requestPasswordReset({
    email: "john.doe@example.com", // required
    redirectTo: "https://example.com/reset-password",
});
```

```ALWAYS CLIENT 
import { authClient } from "@/lib/auth-client"
const { data, error } = await authClient.resetPassword({
  newPassword: "password1234",
  token,
});
```

```
const { data, error } = await authClient.changePassword({
    newPassword: "newpassword1234", // required
    currentPassword: "oldpassword1234", // required
    revokeOtherSessions: true,
});
```

```ALWAYS CLIENT
import { authClient } from "@/lib/auth-client"
await authClient.updateUser({
    image: "https://example.com/image.jpg",
    name: "John Doe",
})
```

```ALWAYS CLIENT
import { authClient } from "@/lib/auth-client"
await authClient.changeEmail({
    newEmail: "new-email@email.com",
    callbackURL: "/dashboard", // to redirect after verification
});
```

```
const metadata = { someKey: "someValue" };
const data = await auth.api.createOrganization({
    body: {
        name: "My Organization", // required
        slug: "my-org", // required
        logo: "https://example.com/logo.png",
        metadata,
        userId: "some_user_id",
        keepCurrentActiveOrganization: false,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

```
const { data, error } = await authClient.organization.setActive({
    organizationId: "org-id",
    organizationSlug: "org-slug",
});
```

```
const { data, error } = await authClient.organization.listMembers({
    query: {
        organizationId: "organization-id",
        limit: 100,
        offset: 0,
        sortBy: "createdAt",
        sortDirection: "desc",
        filterField: "createdAt",
        filterOperator: "eq",
        filterValue: "value",
    },
});
```

```
const data = await auth.api.addMember({
    body: {
        userId: "user-id",
        role: ["admin", "sale"], // required
        organizationId: "org-id",
        teamId: "team-id",
    },
});
```

https://better-auth.com/docs/plugins/organization#access-control


window.addEventListener('pageshow', (event) => {
  if (event.persisted && !document.cookie.match(/my-cookie)) {
    // Force a reload if the user has logged out.
    location.reload();
  }
});

const reloadOnBfCache = (e) => {
  if (e.persisted) {
    globalThis.location.reload();
  }
};
window.addEventListener('pageshow', reloadOnBfCache);

  <script>
    const { signIn, signOut } = await import("./lib/auth-client")
    document.querySelector("#login").onclick = () => signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    })
    document.querySelector("#logout").onclick = () => signOut()
  </script>

export const prerender = false; // Not needed in 'server' mode

const session = await auth.api.getSession({
  headers: Astro.request.headers,
});

import { auth } from "../../../auth"; // import your Better Auth instance
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const isAuthed = await auth.api
    .getSession({
      headers: context.request.headers,
    })
  if (context.url.pathname === "/dashboard" && !isAuthed) {
    return context.redirect("/");
  }
  return next();
});

GET (read)
POST (create)
PUT (replace)
PATCH (update)
DELETE (delete)

POST   /todos         → Create todo  
GET    /todos         → List todos  
GET    /todos/{id}    → Get a specific todo  
PUT    /todos/{id}    → Replace entire todo  
PATCH  /todos/{id}    → Update fields  
DELETE /todos/{id}    → Delete todo

Use lowercase with hyphens (/user-profiles

Only nest when something truly belongs to something else. User settings belong to and die with the user, so /users/{id}/settings makes sense. Comments can exist independently, so /users/{id}/posts/{postId}/comments can be simplified.

# Instead of deep nesting
GET /users/{userId}/habits/{habitId}/entries

# Use filters for flexibility
GET /entries?userId={userId}&habitId={habitId}
GET /entries?habitId={habitId}  # Now you can get entries without knowing the user

Response {data, meta, pagination, total, hasMore, nextCursor}

// What you ship first
{ "id": 1, "name": "John Doe" }

// What you ship later (keeping the old field)
{
  "id": 1,
  "name": "John Doe",  // Still there! Mark it deprecated in docs
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
  "errors": [
    {
      "field": "name",
      "reason": "Must be between 1 and 100 characters",
      "value": ""
    },
    {
      "field": "frequency",
      "reason": "Must be one of: daily, weekly, monthly",
      "value": "sometimes"
    }
  ]
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
200 OK              // Successful GET, PUT, PATCH, DELETE
201 Created         // Successful POST
204 No Content      // Successful DELETE (no response body)
202 Accepted        // Request accepted, processing async
// Client error codes (4xx)
400 Bad Request     // Invalid request format
401 Unauthorized    // Not authenticated
403 Forbidden       // Authenticated but not authorized
404 Not Found       // Resource doesn't exist
405 Method Not Allowed // Wrong HTTP method
409 Conflict        // Resource conflict (duplicate, version mismatch)
422 Unprocessable Entity // Validation error
429 Too Many Requests // Rate limit exceeded
// Server error codes (5xx)
500 Internal Server Error // Generic server error
502 Bad Gateway     // Upstream service error
503 Service Unavailable // Temporary downtime
504 Gateway Timeout // Upstream service timeout

{
  "data": [
    { "id": "1", "name": "User 1" },
    { "id": "2", "name": "User 2" }
  ],
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
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "age",
        "message": "Must be at least 18"
      }
    ]
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