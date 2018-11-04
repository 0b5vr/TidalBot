// == includes =================================================================
#include <nan.h>
#include <jack/jack.h>

// == definitions ==============================================================
#define STR_SIZE 256
#define DEFAULT_CLIENT_NAME "jack_audio"

// == globals ==================================================================
char gJackClientName[ STR_SIZE ];
jack_port_t *gJackPortInL = NULL;
jack_port_t *gJackPortInR = NULL;
jack_client_t *gJackClient = NULL;
Nan::Callback gOnProcess;

typedef struct processData {
  jack_default_audio_sample_t *inL, *inR;
  jack_nframes_t nframes;
} ProcessData;

/**
 * why
 */
void h( uv_work_t* req ) {}

/**
 * um
 */
void postProcess( uv_work_t* req ) {
  v8::Isolate *isolate = v8::Isolate::GetCurrent();
  v8::HandleScope scope(isolate);

  ProcessData *data = static_cast<ProcessData *>( req->data );
  jack_default_audio_sample_t *inL = data->inL;
  jack_default_audio_sample_t *inR = data->inR;
  jack_nframes_t nframes = data->nframes;

  v8::Local<v8::Array> sendL = Nan::New<v8::Array>( nframes );
  v8::Local<v8::Array> sendR = Nan::New<v8::Array>( nframes );
  for ( int i = 0; i < (int)nframes; i ++ ) {
    Nan::Set( sendL, i, Nan::New<v8::Number>( inL[ i ] ) );
    Nan::Set( sendR, i, Nan::New<v8::Number>( inR[ i ] ) );
  }

  v8::Local<v8::Array> send = Nan::New<v8::Array>();
  Nan::Set( send, 0, sendL );
  Nan::Set( send, 1, sendR );

  v8::Local<v8::Value> argv[ 2 ] = { Nan::New<v8::Number>( nframes ), send };
  Nan::Call( gOnProcess, 2, argv );

  delete data;
  delete req;
}

/**
 * It will be applied to jack process callback
 */
int jackProcess( jack_nframes_t nframes, void *arg )
{
  if ( gOnProcess.IsEmpty() ) {
    return 0;
  }

  uv_work_t *req = new uv_work_t;
  ProcessData *data = new ProcessData;

  data->inL = (jack_default_audio_sample_t *)jack_port_get_buffer( gJackPortInL, nframes );
  data->inR = (jack_default_audio_sample_t *)jack_port_get_buffer( gJackPortInR, nframes );
  data->nframes = nframes;

  req->data = data;

  uv_queue_work( uv_default_loop(), req, h, reinterpret_cast<uv_after_work_cb>(postProcess) );

  return 0;
}

/**
 * stab stab stab
 */
void kill()
{
  gJackPortInL = NULL;
  gJackPortInR = NULL;

  if ( gJackClient != NULL ) {
    jack_client_close( gJackClient );
    gJackClient = NULL;
  }
}

/**
 * It will be applied to jack shutdown callback
 */
void jackShutdown( void *arg )
{
  kill();
}

/**
 * Starts jack client.
 * @param {string} client Client name
 */
NAN_METHOD( nodeStart )
{
  // argument check
  if ( info.Length() < 1 ) {
    Nan::ThrowTypeError( "1 argument is required" );
    return;
  }

  if ( !info[ 0 ]->IsString() ) {
    Nan::ThrowTypeError( "Client name (arg1) must be string" );
    return;
  }

  jack_status_t status;

  // read client name given as argument
  v8::Local<v8::String> name = Nan::To<v8::String>( info[ 0 ] ).ToLocalChecked();
  if ( STR_SIZE <= name->Length() ) {
    Nan::ThrowError( "Client name is too loooooooong" );
  }
  Nan::DecodeWrite( gJackClientName, name->Length(), name );

  // open client
  gJackClient = jack_client_open( gJackClientName, JackNullOption, &status, NULL );
  if ( gJackClient == NULL ) {
    if ( status & JackServerFailed ) {
      Nan::ThrowError( "Unable to connect to JACK server" );
    } else {
      Nan::ThrowError( "jack_client_open() failed" );
    }
    return;
  }

  if ( status & JackNameNotUnique ) {
    Nan::ThrowError( "Client name must be unique" );
    kill();
    return;
  }

  // setup callback function
  jack_set_process_callback( gJackClient, jackProcess, 0 );
  jack_on_shutdown( gJackClient, jackShutdown, 0 );

  // register ports
  gJackPortInL = jack_port_register( gJackClient, "inL", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0 );
  gJackPortInR = jack_port_register( gJackClient, "inR", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0 );

  if ( ( gJackPortInL == NULL ) || ( gJackPortInR == NULL ) ) {
    Nan::ThrowError( "There is something wrong with JACK ports" );
    kill();
    return;
  }

  // activate client
  if ( jack_activate( gJackClient ) ) {
    Nan::ThrowError( "Something weird happened when attempt to activate the client" );
    return;
  }
}

/**
 * Closes jack client.
 */
NAN_METHOD( nodeClose )
{
  kill();
}

/**
 * Bind callback method.
 */
NAN_METHOD( nodeBind )
{
  // argument check
  if ( info.Length() < 1 ) {
    Nan::ThrowTypeError( "1 argument is required" );
    return;
  }

  if ( !info[ 0 ]->IsFunction() ) {
    Nan::ThrowTypeError( "Binding function (arg1) must be function" );
    return;
  }

  // bind function
  gOnProcess.Reset( Nan::To<v8::Function>( info[ 0 ] ).ToLocalChecked() );
}

// == bind methods and done ====================================================
NAN_MODULE_INIT( init )
{
  Nan::SetMethod( target, "start", nodeStart );
  Nan::SetMethod( target, "close", nodeClose );
  Nan::SetMethod( target, "bind", nodeBind );
}

NODE_MODULE( addon, init )