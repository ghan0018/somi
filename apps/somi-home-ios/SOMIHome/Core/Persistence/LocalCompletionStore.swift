import CoreData
import Foundation

struct PendingCompletionItem {
    let id: String
    let dateLocal: String
    let occurrence: Int
    let exerciseVersionId: String
    let idempotencyKey: String
    let source: String
    let syncAttempts: Int
}

final class LocalCompletionStore {
    static let shared = LocalCompletionStore()

    private let container: NSPersistentContainer

    private init() {
        // Build model programmatically
        let model = NSManagedObjectModel()

        let entity = NSEntityDescription()
        entity.name = "PendingCompletion"
        entity.managedObjectClassName = NSStringFromClass(NSManagedObject.self)

        let idAttr = NSAttributeDescription()
        idAttr.name = "id"
        idAttr.attributeType = .UUIDAttributeType
        idAttr.isOptional = false

        let dateLocalAttr = NSAttributeDescription()
        dateLocalAttr.name = "dateLocal"
        dateLocalAttr.attributeType = .stringAttributeType
        dateLocalAttr.isOptional = false

        let occurrenceAttr = NSAttributeDescription()
        occurrenceAttr.name = "occurrence"
        occurrenceAttr.attributeType = .integer16AttributeType
        occurrenceAttr.isOptional = false

        let exerciseVersionIdAttr = NSAttributeDescription()
        exerciseVersionIdAttr.name = "exerciseVersionId"
        exerciseVersionIdAttr.attributeType = .stringAttributeType
        exerciseVersionIdAttr.isOptional = false

        let idempotencyKeyAttr = NSAttributeDescription()
        idempotencyKeyAttr.name = "idempotencyKey"
        idempotencyKeyAttr.attributeType = .stringAttributeType
        idempotencyKeyAttr.isOptional = false

        let sourceAttr = NSAttributeDescription()
        sourceAttr.name = "source"
        sourceAttr.attributeType = .stringAttributeType
        sourceAttr.isOptional = false

        let createdAtAttr = NSAttributeDescription()
        createdAtAttr.name = "createdAt"
        createdAtAttr.attributeType = .dateAttributeType
        createdAtAttr.isOptional = false

        let syncAttemptsAttr = NSAttributeDescription()
        syncAttemptsAttr.name = "syncAttempts"
        syncAttemptsAttr.attributeType = .integer16AttributeType
        syncAttemptsAttr.isOptional = false
        syncAttemptsAttr.defaultValue = Int16(0)

        entity.properties = [
            idAttr, dateLocalAttr, occurrenceAttr, exerciseVersionIdAttr,
            idempotencyKeyAttr, sourceAttr, createdAtAttr, syncAttemptsAttr,
        ]

        model.entities = [entity]

        container = NSPersistentContainer(name: "SOMICompletions", managedObjectModel: model)
        container.loadPersistentStores { _, error in
            if let error {
                fatalError("Core Data failed to load: \(error.localizedDescription)")
            }
        }
    }

    @discardableResult
    func enqueue(dateLocal: String, occurrence: Int, exerciseVersionId: String, source: String) -> String {
        let context = container.viewContext
        let entity = NSEntityDescription.entity(forEntityName: "PendingCompletion", in: context)!
        let object = NSManagedObject(entity: entity, insertInto: context)

        let uuid = UUID()
        object.setValue(uuid, forKey: "id")
        object.setValue(dateLocal, forKey: "dateLocal")
        object.setValue(Int16(occurrence), forKey: "occurrence")
        object.setValue(exerciseVersionId, forKey: "exerciseVersionId")
        object.setValue(uuid.uuidString, forKey: "idempotencyKey")
        object.setValue(source, forKey: "source")
        object.setValue(Date(), forKey: "createdAt")
        object.setValue(Int16(0), forKey: "syncAttempts")

        try? context.save()
        return uuid.uuidString
    }

    func fetchAllPending() -> [PendingCompletionItem] {
        let context = container.viewContext
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingCompletion")
        request.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

        guard let results = try? context.fetch(request) else { return [] }

        return results.compactMap { object in
            guard
                let id = object.value(forKey: "id") as? UUID,
                let dateLocal = object.value(forKey: "dateLocal") as? String,
                let exerciseVersionId = object.value(forKey: "exerciseVersionId") as? String,
                let idempotencyKey = object.value(forKey: "idempotencyKey") as? String,
                let source = object.value(forKey: "source") as? String
            else { return nil }

            let occurrence = object.value(forKey: "occurrence") as? Int16 ?? 0
            let syncAttempts = object.value(forKey: "syncAttempts") as? Int16 ?? 0

            return PendingCompletionItem(
                id: id.uuidString,
                dateLocal: dateLocal,
                occurrence: Int(occurrence),
                exerciseVersionId: exerciseVersionId,
                idempotencyKey: idempotencyKey,
                source: source,
                syncAttempts: Int(syncAttempts)
            )
        }
    }

    func markSynced(id: String) {
        deleteItem(id: id)
    }

    func incrementAttempts(id: String) {
        let context = container.viewContext
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingCompletion")
        request.predicate = NSPredicate(format: "id == %@", UUID(uuidString: id)! as CVarArg)

        guard let results = try? context.fetch(request), let object = results.first else { return }
        let current = object.value(forKey: "syncAttempts") as? Int16 ?? 0
        object.setValue(current + 1, forKey: "syncAttempts")
        try? context.save()
    }

    var pendingCount: Int {
        let context = container.viewContext
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingCompletion")
        return (try? context.count(for: request)) ?? 0
    }

    private func deleteItem(id: String) {
        let context = container.viewContext
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingCompletion")
        request.predicate = NSPredicate(format: "id == %@", UUID(uuidString: id)! as CVarArg)

        guard let results = try? context.fetch(request), let object = results.first else { return }
        context.delete(object)
        try? context.save()
    }
}
