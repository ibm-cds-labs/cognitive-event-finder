'use strict';

class CloudantEventStore {

    /**
     * Creates a new instance of CloudantEventStore.
     * @param {Object} cloudant - The instance of cloudant to connect to
     * @param {string} dbName - The name of the database to use
     */
    constructor(cloudant, dbName) {
        this.cloudant = cloudant;
        this.dbName = dbName;
        this.db = null;
    }

    /**
     * Creates and initializes the database.
     * @returns {Promise.<TResult>}
     */
    init() {
        console.log('Getting event database...');
        this.db = this.cloudant.db.use(this.dbName);
        // see if the by_popularity design doc exists, if not then create it
        return this.db.find({selector: {'_id': '_design/search'}})
            .then((result) => {
                if (result && result.docs && result.docs.length > 0) {
                    return Promise.resolve();
                }
                else {
                    let designDoc = {
                        _id: '_design/search',
                        indexes: {
                            by_topic: {
                                index: 'function (doc) { \nif (doc.name) { \nindex("name", doc.name, {boost: 2}); \n} \nif (doc.description) { \nindex("description", doc.description, {boost: 1}); \n} \nif (doc.track) { \nindex("track", doc.track, {boost: 2}); \n} \nif (doc.tags && doc.tags.length && doc.tags.length > 0) { \nfor (var i=0; i<doc.tags.length; i++) { \nindex("tag", doc.tags[i].name, {boost: 10}); \n} \n} \n}'
                            },
                            by_speaker: {
                                index: 'function (doc) { \nif (doc.speakers && doc.speakers.length && doc.speakers.length > 0) { \nfor (var i=0; i<doc.speakers.length; i++) { \nindex("speaker", doc.speakers[i].name, {}); \n} \n} \n}'
                            },
                            by_music_topic: {
                                index: 'function (doc) { \nif (doc.music) { \nif (doc.name) { \nindex("name", doc.name, {boost: 2}); \n} \nif (doc.description) { \nindex("description", doc.description, {boost: 1}); \n} \nif (doc.track) { \nindex("track", doc.track, {boost: 2}); \n} \nif (doc.tags && doc.tags.length && doc.tags.length > 0) { \nfor (var i=0; i<doc.tags.length; i++) { \nindex("tag", doc.tags[i].name, {boost: 10}); \n} \n} \n} \nif (doc.speakers && doc.speakers.length && doc.speakers.length > 0) { \nfor (var i=0; i<doc.speakers.length; i++) { \nindex("artist", doc.speakers[i].name, {boost: 5}); \n} \n} \n}'
                            },
                            by_music_artist: {
                                index: 'function (doc) { \nif (doc.music) { \nif (doc.speakers && doc.speakers.length && doc.speakers.length > 0) { \nfor (var i=0; i<doc.speakers.length; i++) { \nindex("artist", doc.speakers[i].name, {}); \n} \n} \n} \n}'
                            }
                        }
                    };
                    return this.db.insert(designDoc);
                }
            })
            .catch((err) => {
                console.log(`Cloudant error: ${JSON.stringify(err)}`);
            });
    }

    /**
     * Searches for events based on topic.
     * @param searchStr - The search string
     * @param count - Max number of events to return
     * @returns {Promise.<TResult>}
     */
    findEventsByTopic(searchStr, count) {
        var query = `name:${searchStr} OR description:${searchStr} OR track:${searchStr} OR tag:${searchStr}`;
        return this.findEvents('search', 'by_topic', query, count);
    }

    /**
     * Searches for events based on speaker.
     * @param searchStr - The search string
     * @param count - Max number of events to return
     * @returns {Promise.<TResult>}
     */
    findEventsBySpeaker(searchStr, count) {
        return this.findEvents('search', 'by_speaker', `speaker:${searchStr}`, count);
    }

    /**
     * Finds a list of suggested events based on ???
     * @param count - Max number of events to return
     * @returns {Promise.<TResult>}
     */
    findSuggestedEvents(count) {
        return this.findEvents('search', 'by_speaker', '*:*', count);
    }

    /**
     * Searches for music events based on topic.
     * @param searchStr - The search string
     * @param count - Max number of events to return
     * @returns {Promise.<TResult>}
     */
    findMusicEventsByTopic(searchStr, count) {
        var query = `name:${searchStr} OR description:${searchStr} OR track:${searchStr} OR tag:${searchStr} OR artist:${searchStr}`;
        return this.findEvents('search', 'by_music_topic', query, count);
    }

    /**
     * Searches for events based on topic.
     * @param searchStr - The search string
     * @param count - Max number of events to return
     * @returns {Promise.<TResult>}
     */
    findMusicEventsByArtist(searchStr, count) {
        return this.findEvents('search', 'by_music_artist', `artist:${searchStr}`, count);
    }

    /**
     * Queries the specified design doc and search index
     * @param designDoc
     * @param searchIndex
     * @param query
     * @param count
     * @returns {Promise.<TResult>}
     */
    findEvents(designDoc, searchIndex, query, count) {
        return this.db.search(designDoc, searchIndex, {q:query, include_docs:true})
            .then((result) => {
                if (result.rows) {
                    var events = [];
                    var i = -1;
                    for (var row of result.rows) {
                        if (count <= 0 || ++i < count) {
                            events.push(row.doc);
                        }
                        else {
                            break;
                        }
                    }
                    return Promise.resolve(events);
                }
                else {
                    return Promise.resolve();
                }
            });
    }

    /**
     * Finds a list of events based on id.
     * @param ids - IDs of the events to retrieve
     * @returns {Promise.<TResult>}
     */
    getEventsForIds(ids) {
        let selector = {
            '_id': {'$in': ids}
        };
        return this.db.find({selector: selector})
            .then((result) => {
                if (result.docs) {
                    return Promise.resolve(result.docs);
                }
                else {
                    return Promise.resolve();
                }
            });
    }
}

module.exports = CloudantEventStore;