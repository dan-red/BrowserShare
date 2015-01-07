from twisted.web.server import Site
from twisted.web.resource import Resource
from twisted.internet import reactor
import json
import urllib

masterInfo = {"curURL": "http://cs.swarthmore.edu", "counter": -1}

class Ping(Resource):
     isLeaf = True

     def render_POST(self, request):
         print 'Request is:', request

         request.setHeader('Access-Control-Allow-Origin', '*')
         #request.setHeader('Access-Control-Allow-Methods', 'POST')
         #request.setHeader('Access-Control-Allow-Origin', '*')
         #request.setHeader('Access-Control-Max-Age', 120)

         global masterInfo
         return json.dumps(masterInfo)

# TODO: Add server logic for URL reception.
class URL_Update(Resource):
     isLeaf = True

     def render_POST(self, request):
         print 'Request is:', requesty

         request.setHeader('Access-Control-Allow-Origin', '*')

         global masterInfo
         tokens = assembleTokens(request)

         #This is messy, but it works. Try to clean up later?
         #tokens[0] is url=... tokens[1] is counter=...

         masterInfo["curURL"] = tokens[0][4:] #first four chars are 'url='
         if masterInfo["counter"] < int(tokens[1].split('=')[1]):
                #masterInfo["curURL"] = tokens[0][4:]
 masterInfo["counter"] = int(tokens[1].split('=')[1])

         print "masterURL: " + masterInfo["curURL"]
         print "masterCount: " + str(masterInfo["counter"])

         return '{ "message": true }'

# TODO: Clean up Client communication. Depends if we choose HTTP Get or Post.
def assembleTokens(request):

    tokens = request.uri.split('?')[1] #separate server url from query
    tokens = tokens.split('&') #Each query element is separated by a &
    for element in range(len(tokens)):
        tokens[element] = urllib.unquote(tokens[element])
        #print tokens[element]

    return tokens


root = Resource()
root.putChild("ping", Ping())
root.putChild("URL_update", URL_Update())

factory = Site(root)
reactor.listenTCP(8880, factory)
reactor.run()
