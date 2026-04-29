- Add GitHub Linking to Database
- Calculate leftover Budgets
- Add Archived State & Filter

- (Notifications e.g. Mail, Slack, Webhook)
- (Add API & self-service)
  - Request Projects
  - Add Milestones
  - Export CSV 
  - API
- Add Audit History (Org and Project level)


## commands

Install all dev tools
```shell
mise i
```

Install all deps if not done by `mise`
```shell
pn i
```

Update browserlist
```shell
pn update-browserslist-db latest
```

Generate types
```shell
pn types
```

Deploy to cloudflare
```shell
pn run deploy
```

Biome
```shell
pn biome check --write
```
sync astro
```shell
pn astro sync
```

Types
```shell
pn run check
```

```shell
pn auth info
pn auth generate

pn drizzle-kit generate
pn drizzle-kit check

pn drizzle-kit migrate
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