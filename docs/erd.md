# Diagrama ER (generado contra la base viva)

_Base: `gestion_documental` · generado: 10/12/2026 - 5:44:52 AM_

```mermaid
erDiagram
    users {
        string email
        string emailNormalized
        string passwordHash
        string role
        boolean isActive
        number storage.quotaBytes
        number storage.usedBytes
        ObjectId _id PK
        date createdAt
        date updatedAt
    }
    folders {
        ObjectId ownerId
        ObjectId createdBy
        ObjectId parentId
        boolean isRoot
        string name
        string nameNormalized
        array ancestors
        boolean isDeleted
        date deletedAt
        ObjectId deletionId
        boolean isDeletionRoot
        ObjectId _id PK
        date createdAt
        date updatedAt
    }
    files {
        ObjectId ownerId
        ObjectId folderId
        string name
        string nameNormalized
        string mimeType
        string category
        number size
        ObjectId gridFsId
        boolean isDeleted
        date deletedAt
        ObjectId deletionId
        boolean isDeletionRoot
        ObjectId _id PK
        date createdAt
        date updatedAt
    }
    shares {
        string resourceType
        ObjectId resourceId
        ObjectId ownerId
        ObjectId sharedWithId
        string permission
        string origin
        ObjectId _id PK
        date createdAt
    }
    activity_logs {
        ObjectId userId
        string action
        string status
        string resourceType
        ObjectId resourceId
        object resourceSnapshot
        object details
        array affectedUserIds
        date timestamp
        ObjectId _id PK
    }
    files }o--|| users : "ownerId"
    files }o--|| folders : "folderId"
    folders }o--|| users : "ownerId"
    folders }o--|| users : "createdBy"
    folders }o--|| folders : "parentId"
    shares }o--|| users : "ownerId"
    shares }o--|| users : "sharedWithId"
    shares }o--|| files : "resourceId"
    activity_logs }o--|| users : "userId"
    activity_logs }o--|| files : "resourceId"
```

## Índices por colección

### `users` (1 documentos)

- `{ _id:1 }`
- `{ emailNormalized:1 }` (unique)
- `{ isActive:1, role:1 }`

### `folders` (1 documentos)

- `{ _id:1 }`
- `{ parentId:1, isDeleted:1, nameNormalized:1 }`
- `{ ancestors:1, isDeleted:1 }`
- `{ parentId:1, nameNormalized:1 }` (unique, partial {"isDeleted":false,"isRoot":false})
- `{ ownerId:1 }` (unique, partial {"isRoot":true})
- `{ ownerId:1, deletedAt:-1 }` (partial {"isDeleted":true,"isDeletionRoot":true})
- `{ deletionId:1 }` (partial {"isDeleted":true})

### `files` (0 documentos)

- `{ _id:1 }`
- `{ folderId:1, isDeleted:1, nameNormalized:1 }`
- `{ folderId:1, nameNormalized:1 }` (unique, partial {"isDeleted":false})
- `{ ownerId:1, isDeleted:1, category:1, createdAt:-1 }`
- `{ ownerId:1, isDeleted:1, createdAt:-1 }`
- `{ ownerId:1, isDeleted:1, nameNormalized:1 }`
- `{ isDeleted:1, createdAt:-1 }`
- `{ ownerId:1, deletedAt:-1 }` (partial {"isDeleted":true,"isDeletionRoot":true})
- `{ deletionId:1 }` (partial {"isDeleted":true})

### `shares` (0 documentos)

- `{ _id:1 }`
- `{ resourceId:1, sharedWithId:1 }` (unique)
- `{ sharedWithId:1, createdAt:-1 }`
- `{ ownerId:1, origin:1, createdAt:-1 }`

### `activity_logs` (1 documentos)

- `{ _id:1 }`
- `{ userId:1, timestamp:-1 }`
- `{ resourceType:1, resourceId:1, timestamp:-1 }`
- `{ timestamp:-1 }`
- `{ action:1, status:1, timestamp:-1 }`
- `{ affectedUserIds:1, timestamp:-1 }`
